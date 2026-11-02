-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: injected entity registry and correspondence checker.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local MAX_TICK = 9007199254740991

local function valid_tick(value)
    return type(value) == "number"
        and value == math.floor(value)
        and value >= 0 and value <= MAX_TICK
end

local function valid_lead(value)
    return type(value) == "number"
        and (value == 0 or value == 1)
end

local function copy_snapshot(state)
    return {
        profile = "grimlore.reflection-depiction.v1",
        owner_id = state.owner_id,
        reflection_id = state.reflection_id,
        lead_steps = state.lead_steps,

        semantics = "depicted_not_proven",
        lead_unit = "depicted_step_difference",
        event_order = "unestablished",
        elapsed_time = "unknown",

        mode = state.mode,
        basis = state.basis,
        origin = state.origin,

        -- Observer position on the shared orchestration axis.
        -- It is not evidence of when depicted actions occurred.
        observed_at_tick = state.observed_at_tick
    }
end

function M.new(config)
    assert(type(config) == "table", "configuration required")
    assert(type(config.registry) == "table", "entity registry required")
    assert(type(config.correspondence) == "table",
        "correspondence checker required")

    local registry = config.registry
    local checker = config.correspondence
    local owner_handle = config.owner
    local reflection_handle = config.reflection

    assert(owner_handle ~= reflection_handle,
        "owner and reflection must have distinct identities")

    local owner = registry.read(owner_handle)
    local reflection = registry.read(reflection_handle)

    assert(type(owner.id) == "string" and type(reflection.id) == "string",
        "registered entity IDs required")

    local initial = checker.corresponds(
        registry,
        owner_handle,
        reflection_handle,
        config.correspondence_rule
    )

    assert(initial.status == "satisfied",
        "reflection correspondence was not established")

    local state = {
        owner_id = owner.id,
        reflection_id = reflection.id,
        lead_steps = 1,
        mode = "source_locked",
        basis = "explicit_description",
        origin = "source_depiction",
        observed_at_tick = 0
    }

    local audit = {}
    local api = {}

    local function record(code, subject_id, tick)
        audit[#audit + 1] = {
            code = code,
            subject_id = subject_id,
            tick = tick,
            lead_steps = state.lead_steps,
            semantics = "depicted_not_proven"
        }
    end

    function api.snapshot()
        return copy_snapshot(state)
    end

    function api.observe(shared_tick)
        assert(valid_tick(shared_tick), "invalid shared tick")
        assert(shared_tick >= state.observed_at_tick,
            "observer tick cannot move backward")

        state.observed_at_tick = shared_tick

        -- No lead update, no registry mutation, no inferred owner action.
        return copy_snapshot(state)
    end

    function api.request_lead(subject_handle, lead, shared_tick)
        if not valid_tick(shared_tick)
            or shared_tick < state.observed_at_tick then
            return { status = "rejected", code = "INVALID_SHARED_TICK" }
        end

        if subject_handle ~= reflection_handle then
            record("ANOMALY_SCOPE_DENIED", nil, shared_tick)
            return { status = "rejected", code = "ANOMALY_SCOPE_DENIED" }
        end

        if not valid_lead(lead) then
            record("LEAD_OUT_OF_RANGE", state.reflection_id, shared_tick)
            return { status = "rejected", code = "LEAD_OUT_OF_RANGE" }
        end

        if lead == state.lead_steps then
            return {
                status = "unchanged",
                snapshot = copy_snapshot(state)
            }
        end

        -- A source-locked depiction has no automatic catch-up transition.
        record("SOURCE_DEPICTION_LOCKED", state.reflection_id, shared_tick)
        return {
            status = "rejected",
            code = "SOURCE_DEPICTION_LOCKED"
        }
    end

    function api.authored_branch(options, authorize)
        assert(type(options) == "table", "branch options required")
        assert(valid_lead(options.lead_steps), "invalid authored lead")
        assert(type(options.branch_id) == "string"
            and options.branch_id ~= "", "branch ID required")
        assert(type(options.reason) == "string"
            and options.reason ~= "", "authoring reason required")
        assert(type(authorize) == "function",
            "trusted authoring authorization adapter required")

        local proposal = {
            branch_id = options.branch_id,
            owner_id = state.owner_id,
            reflection_id = state.reflection_id,
            previous_lead_steps = state.lead_steps,
            proposed_lead_steps = options.lead_steps,
            reason = options.reason,
            semantics = "depicted_not_proven",
            basis = "implementation_choice",
            origin = "creative_addition"
        }

        -- Pass a separate record so callback mutation cannot change output.
        local approved = authorize({
            branch_id = proposal.branch_id,
            owner_id = proposal.owner_id,
            reflection_id = proposal.reflection_id,
            previous_lead_steps = proposal.previous_lead_steps,
            proposed_lead_steps = proposal.proposed_lead_steps,
            reason = proposal.reason,
            semantics = proposal.semantics,
            basis = proposal.basis,
            origin = proposal.origin
        })

        if approved ~= true then
            return { status = "rejected", code = "AUTHORING_NOT_AUTHORIZED" }
        end

        -- Returns an authored record, not a mutation of the source machine
        -- and not proof that either character performed an action.
        return {
            status = "authored_record",
            branch_id = proposal.branch_id,
            owner_id = proposal.owner_id,
            reflection_id = proposal.reflection_id,
            lead_steps = proposal.proposed_lead_steps,
            semantics = "depicted_not_proven",
            event_order = "unestablished",
            elapsed_time = "unknown",
            basis = "implementation_choice",
            origin = "creative_addition",
            reason = proposal.reason
        }
    end

    function api.audit()
        local result = {}
        for index, entry in ipairs(audit) do
            result[index] = {
                code = entry.code,
                subject_id = entry.subject_id,
                tick = entry.tick,
                lead_steps = entry.lead_steps,
                semantics = entry.semantics
            }
        end
        return result
    end

    return api
end

return M
