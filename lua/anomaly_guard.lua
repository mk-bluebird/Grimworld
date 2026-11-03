-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: injected registry and correspondence checker.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

function M.new(config)
    local registry = config.registry
    local checker = config.correspondence
    local rules, operation_ids = {}, {}
    local revision, inflight = 0, 0
    local failed_execution = false

    for _, declaration in ipairs(config.rules) do
        assert(type(declaration.id) == "string" and declaration.id ~= "",
            "rule ID required")
        assert(not rules[declaration.id], "duplicate rule ID")
        assert(type(declaration.violation) == "string"
            and declaration.violation ~= "", "violation label required")
        assert(type(declaration.limit) == "number"
            and declaration.limit == math.floor(declaration.limit)
            and declaration.limit >= 1 and declaration.limit <= 1000,
            "invalid invocation limit")
        assert(type(declaration.handler) == "function",
            "trusted handler required")

        local scope, count = {}, 0
        for _, handle in ipairs(declaration.scope) do
            assert(not scope[handle], "duplicate scope handle")
            local entity = registry.read(handle)
            scope[handle] = entity.id
            count = count + 1
        end
        assert(count > 0, "nonempty scope required")

        local prerequisite
        if declaration.correspondence then
            local source = declaration.correspondence
            prerequisite = {
                source = source.source,
                target = source.target,
                -- This is trusted rule configuration. Do not mutate it
                -- after construction.
                rule = source.rule
            }
        end

        rules[declaration.id] = {
            scope = scope,
            violation = declaration.violation,
            limit = declaration.limit,
            used = 0,
            handler = declaration.handler,
            prerequisite = prerequisite
        }
    end

    local api = {}

    function api.apply(request)
        if type(request) ~= "table" or getmetatable(request) ~= nil then
            return { status = "rejected", code = "INVALID_OPERATION" }
        end

        local allowed = {
            rule_id = true, subject = true,
            violation = true, operation_id = true
        }
        for key in pairs(request) do
            if not allowed[key] then
                return { status = "rejected", code = "UNKNOWN_OPERATION_FIELD" }
            end
        end

        local rule = rules[request.rule_id]
        if not rule then
            return { status = "rejected", code = "UNKNOWN_RULE" }
        end
        if not rule.scope[request.subject] then
            return { status = "rejected", code = "ANOMALY_SCOPE_DENIED" }
        end
        if request.violation ~= rule.violation then
            return { status = "rejected", code = "VIOLATION_NOT_ALLOWED" }
        end
        if type(request.operation_id) ~= "string"
            or request.operation_id == "" then
            return { status = "rejected", code = "OPERATION_ID_REQUIRED" }
        end
        if operation_ids[request.operation_id] then
            return { status = "rejected", code = "OPERATION_REPLAY" }
        end
        if rule.used >= rule.limit then
            return { status = "rejected", code = "ANOMALY_LIMIT" }
        end

        if rule.prerequisite then
            local p = rule.prerequisite
            local ok, result = pcall(
                checker.corresponds,
                registry, p.source, p.target, p.rule
            )
            if not ok or type(result) ~= "table"
                or result.status ~= "satisfied" then
                return {
                    status = "rejected",
                    code = "CORRESPONDENCE_PREREQUISITE"
                }
            end
        end

        -- Reserve before execution. No refund after uncertain side effects.
        operation_ids[request.operation_id] = true
        rule.used = rule.used + 1
        revision = revision + 1
        inflight = inflight + 1

        local ok, result = pcall(rule.handler, {
            operation_id = request.operation_id,
            subject = request.subject,
            subject_id = rule.scope[request.subject],
            violation = rule.violation
        })

        inflight = inflight - 1
        revision = revision + 1

        if not ok or result ~= true then
            failed_execution = true
            return {
                status = "operation_failed",
                code = "HANDLER_FAILED",
                side_effects_may_have_occurred = true
            }
        end

        return { status = "applied", operation_id = request.operation_id }
    end

    function api.revision()
        return revision
    end

    function api.publication_status()
        if inflight > 0 then
            return {
                status = "blocked",
                diagnostics = {{ code = "ANOMALY_OPERATION_INFLIGHT" }}
            }
        end
        if failed_execution then
            return {
                status = "invalid",
                diagnostics = {{ code = "ANOMALY_SIDE_EFFECTS_UNVERIFIED" }}
            }
        end
        return { status = "valid", diagnostics = {} }
    end

    return api
end

return M
