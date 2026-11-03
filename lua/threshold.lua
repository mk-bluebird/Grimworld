-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: injected entity registry and reflection.lua instance.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}
local MAX_TICK = 9007199254740991

local STATES = {
    planted = true,
    hovering = true,
    crossed = true
}

local NEXT = {
    planted = { hovering = true },
    hovering = { planted = true, crossed = true },
    crossed = {}
}

local function valid_tick(value)
    return type(value) == "number"
        and value == math.floor(value)
        and value >= 0 and value <= MAX_TICK
end

local function copy_record(record)
    local result = {}
    for key, value in pairs(record) do result[key] = value end
    return result
end

local function approved(authorize, proposal)
    if type(authorize) ~= "function" then return false end

    -- Callback receives a copy, not private state.
    local ok, result = pcall(authorize, copy_record(proposal))
    return ok and result == true
end

function M.new(config)
    assert(type(config) == "table", "configuration required")

    local registry = config.registry
    local owner_handle = config.owner
    local step_handle = config.step
    local reflection = config.reflection

    local owner = registry.read(owner_handle)
    local step = registry.read(step_handle)

    assert(owner_handle ~= step_handle, "owner and step must be distinct")
    assert(type(owner.id) == "string" and type(step.id) == "string",
        "registered IDs required")

    local reflected = reflection.snapshot()
    assert(reflected.owner_id == owner.id,
        "reflection belongs to a different owner")
    assert(reflected.semantics == "depicted_not_proven",
        "reflection semantics must preserve depiction uncertainty")

    local make_machine

    make_machine = function(mode, initial_state, branch_id)
        local state = initial_state
        local last_tick = 0
        local records = {}
        local record_ids = {}
        local fork_ids = {}
        local api = {}

        function api.snapshot()
            local leading_foot =
                state == "planted" and "planted"
                or state == "hovering" and "hovering"
                or "beyond_threshold"

            return {
                profile = "grimlore.submerged-threshold.v1",
                owner_id = owner.id,
                step_id = step.id,
                mode = mode,
                branch_id = branch_id,
                state = state,

                leading_foot = leading_foot,

                -- The source establishes this only in its hovering pose.
                supporting_foot = state == "hovering"
                    and "planted_on_familiar_stone"
                    or "not_specified_by_this_state",

                semantics = "depicted_not_proven",
                crossing = state == "crossed"
                    and "authored_crossing"
                    or "not_established",
                basis = mode == "source_locked"
                    and "explicit_description"
                    or "implementation_choice",

                last_transition_tick = last_tick
            }
        end

        function api.transition(subject_handle, request)
            if subject_handle ~= owner_handle then
                return { status = "rejected", code = "THRESHOLD_SCOPE_DENIED" }
            end

            if type(request) ~= "table"
                or getmetatable(request) ~= nil
                or not STATES[request.from]
                or not STATES[request.to]
                or type(request.record_id) ~= "string"
                or request.record_id == ""
                or type(request.reason) ~= "string"
                or request.reason == ""
                or not valid_tick(request.shared_tick) then
                return { status = "rejected", code = "INVALID_TRANSITION_RECORD" }
            end

            if request.from ~= state then
                return { status = "rejected", code = "STALE_SOURCE_STATE" }
            end

            if not NEXT[state][request.to] then
                return { status = "rejected", code = "TRANSITION_NOT_ALLOWED" }
            end

            if mode == "source_locked" then
                return { status = "rejected", code = "SOURCE_DEPICTION_LOCKED" }
            end

            if record_ids[request.record_id] then
                return { status = "rejected", code = "DUPLICATE_TRANSITION_RECORD" }
            end

            if request.shared_tick < last_tick then
                return { status = "rejected", code = "TICK_MOVED_BACKWARD" }
            end

            local record = {
                operation = "threshold_transition",
                record_id = request.record_id,
                branch_id = branch_id,
                owner_id = owner.id,
                step_id = step.id,
                from = state,
                to = request.to,
                shared_tick = request.shared_tick,
                reason = request.reason,
                basis = "implementation_choice",
                origin = "creative_addition"
            }

            if not approved(config.authorize, record) then
                return { status = "rejected", code = "AUTHORING_NOT_AUTHORIZED" }
            end

            -- Commit only after the complete transition is approved.
            state = record.to
            last_tick = record.shared_tick
            record_ids[record.record_id] = true
            records[#records + 1] = record

            return {
                status = "updated",
                snapshot = api.snapshot(),
                record = copy_record(record)
            }
        end

        function api.fork_authored(request)
            if type(request) ~= "table"
                or not STATES[request.initial_state]
                or request.initial_state == "crossed"
                or type(request.branch_id) ~= "string"
                or request.branch_id == ""
                or type(request.reason) ~= "string"
                or request.reason == "" then
                return { status = "rejected", code = "INVALID_BRANCH_REQUEST" }
            end

            if fork_ids[request.branch_id] then
                return { status = "rejected", code = "DUPLICATE_LOCAL_BRANCH_ID" }
            end

            local record = {
                operation = "threshold_branch",
                branch_id = request.branch_id,
                owner_id = owner.id,
                step_id = step.id,
                source_state = state,
                initial_state = request.initial_state,
                reason = request.reason,
                basis = "implementation_choice",
                origin = "creative_addition"
            }

            if not approved(config.authorize, record) then
                return { status = "rejected", code = "AUTHORING_NOT_AUTHORIZED" }
            end

            fork_ids[request.branch_id] = true

            return {
                status = "authored_branch",
                machine = make_machine(
                    "authored_branch",
                    request.initial_state,
                    request.branch_id
                ),
                record = copy_record(record)
            }
        end

        function api.audit()
            local result = {}
            for index, record in ipairs(records) do
                result[index] = copy_record(record)
            end
            return result
        end

        return api
    end

    return make_machine("source_locked", "hovering", "source")
end

return M
