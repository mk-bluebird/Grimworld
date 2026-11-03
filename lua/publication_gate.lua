-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: loader, citation graph, anomaly guard, semantic adapter, sink.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local function valid_outcome(value)
    if type(value) ~= "table" or getmetatable(value) ~= nil
        or rawget(value, "status") ~= "valid" then
        return false
    end

    local diagnostics = rawget(value, "diagnostics")
    if type(diagnostics) ~= "table"
        or getmetatable(diagnostics) ~= nil
        or next(diagnostics) ~= nil then
        return false
    end

    -- Deliberately narrow internal success envelope.
    for key in pairs(value) do
        if key ~= "status" and key ~= "diagnostics" then return false end
    end
    return true
end

local function copy_list(values)
    if type(values) ~= "table" or getmetatable(values) ~= nil then
        error("support list required")
    end

    local count, largest = 0, 0
    for key in pairs(values) do
        assert(type(key) == "number" and key >= 1
            and key == math.floor(key), "invalid support list")
        count = count + 1
        if key > largest then largest = key end
    end
    assert(count == largest, "dense support list required")

    local result = {}
    for i = 1, count do result[i] = values[i] end
    return result
end

function M.new(config)
    assert(type(config.additional_checks) == "function",
        "composed semantic-check adapter required")
    assert(type(config.sink) == "function", "publication sink required")

    local loader = config.loader
    local citations = config.citations
    local guard = config.anomaly_guard
    local additional_checks = config.additional_checks
    local sink = config.sink

    local permits = setmetatable({}, { __mode = "k" })
    local api = {}

    local function prepare_inner(document, supports)
        if type(supports) ~= "table" or getmetatable(supports) ~= nil then
            return { status = "invalid", code = "INVALID_SUPPORT_MAP" }
        end

        local loaded = loader.load(document)
        if loaded.status ~= "accepted" then
            return {
                status = loaded.status == "resource_limit"
                    and "budget_exhausted" or "invalid",
                code = "SCENE_NOT_ADMITTED",
                diagnostics = loaded.diagnostics
            }
        end

        local snapshot = loader.read(loaded.token)
        local nodes, known = {}, {}
        local entity_ids = {}

        for _, entity in ipairs(snapshot.entities) do
            entity_ids[entity.id] = true
        end

        local function entity_ref(id)
            return entity_ids[id] == true
        end

        local composition = snapshot.composition
        if not entity_ref(composition.principal_subject)
            or not entity_ref(composition.focal_target) then
            return { status = "invalid", code = "DANGLING_COMPOSITION_REF" }
        end

        for _, id in ipairs(composition.eye_path) do
            if not entity_ref(id) then
                return { status = "invalid", code = "DANGLING_COMPOSITION_REF" }
            end
        end

        for _, name in ipairs({"foreground", "middle_ground", "background"}) do
            for _, id in ipairs(composition.depth_layers[name]) do
                if not entity_ref(id) then
                    return { status = "invalid", code = "DANGLING_DEPTH_REF" }
                end
            end
        end

        for _, relationship in ipairs(snapshot.relationships) do
            if not entity_ref(relationship.subject)
                or not entity_ref(relationship.object) then
                return { status = "invalid", code = "DANGLING_RELATIONSHIP_REF" }
            end
        end

        for _, group in ipairs({
            {"entity", snapshot.entities},
            {"relationship", snapshot.relationships},
            {"constraint", snapshot.constraints}
        }) do
            for _, item in ipairs(group[2]) do
                local ref = group[1] .. ":" .. item.id
                known[ref] = true
                nodes[#nodes + 1] = {
                    ref = ref,
                    basis = item.basis,
                    supports = supports[ref] == nil
                        and {} or copy_list(supports[ref])
                }
            end
        end

        for ref in pairs(supports) do
            if not known[ref] then
                return { status = "invalid", code = "UNKNOWN_SUPPORT_OWNER" }
            end
        end

        local citation_result = citations.validate(nodes)
        if not valid_outcome(citation_result) then
            return {
                status = citation_result.status == "budget_exhausted"
                    and "budget_exhausted" or "invalid",
                code = "CITATION_CHECK_FAILED",
                diagnostics = citation_result.diagnostics
            }
        end

        local semantic_result = additional_checks(loader.read(loaded.token))
        if not valid_outcome(semantic_result) then
            return {
                status = type(semantic_result) == "table"
                    and semantic_result.status == "budget_exhausted"
                    and "budget_exhausted" or "blocked",
                code = "SEMANTIC_CHECK_NOT_VALID"
            }
        end

        if not valid_outcome(guard.publication_status()) then
            return { status = "blocked", code = "ANOMALY_STATE_NOT_VALID" }
        end

        local permit = {}
        permits[permit] = {
            scene_token = loaded.token,
            guard_revision = guard.revision()
        }

        return { status = "valid", permit = permit }
    end

    function api.prepare(document, supports)
        local ok, result = pcall(prepare_inner, document, supports)
        if not ok then
            return { status = "worker_failed", code = "ADMISSION_FAILED" }
        end
        return result
    end

    function api.publish(permit)
        if type(permit) ~= "table" or not permits[permit] then
            return { status = "rejected", code = "INVALID_OR_CONSUMED_PERMIT" }
        end

        local entry = permits[permit]
        permits[permit] = nil

        local ok, result = pcall(function()
            if guard.revision() ~= entry.guard_revision
                or not valid_outcome(guard.publication_status()) then
                return { status = "rejected", code = "STALE_ANOMALY_STATE" }
            end

            local receipt = sink(loader.read(entry.scene_token))

            if type(receipt) ~= "table"
                or receipt.status ~= "written"
                or type(receipt.target) ~= "string"
                or receipt.target == ""
                or type(receipt.receipt_id) ~= "string"
                or receipt.receipt_id == "" then
                return {
                    status = "publication_failed",
                    side_effects_may_have_occurred = true
                }
            end

            return {
                status = "written",
                target = receipt.target,
                receipt_id = receipt.receipt_id
            }
        end)

        if not ok then
            return {
                status = "worker_failed",
                code = "PUBLICATION_FAILED",
                side_effects_may_have_occurred = true
            }
        end

        return result
    end

    return api
end

return M
