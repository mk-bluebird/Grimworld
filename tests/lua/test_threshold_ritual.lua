-- RUNTIME: standard Lua 5.1 / Lua 5.4.
-- Luau requires module-loading/output adapters.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local Threshold = require("lua.threshold")
local Ritual = require("lua.ritual_clay_houses")

local records = {}
local registry = {
    read = function(handle)
        assert(records[handle], "foreign registry handle")
        return records[handle]
    end
}

local function registered(id)
    local handle = {}
    records[handle] = { id = id }
    return handle
end

local widow = registered("widow")
local step = registered("submerged_step")
local group = registered("clay_house_ritual")
local house1 = registered("clay_house_1")
local house2 = registered("clay_house_2")
local house3 = registered("clay_house_3")

local reflection = {
    snapshot = function()
        return {
            owner_id = "widow",
            semantics = "depicted_not_proven",
            lead_steps = 1
        }
    end
}

local source = Threshold.new({
    registry = registry,
    owner = widow,
    step = step,
    reflection = reflection,
    authorize = function(record)
        -- Test double; actual authority comes from the host.
        return record.branch_id == "test-branch"
    end
})

assert(source.snapshot().state == "hovering")
assert(source.snapshot().supporting_foot ==
    "planted_on_familiar_stone")
assert(source.snapshot().crossing == "not_established")

local locked = source.transition(widow, {
    record_id = "source-crossing",
    from = "hovering",
    to = "crossed",
    shared_tick = 1,
    reason = "Attempt to resolve source depiction."
})
assert(locked.code == "SOURCE_DEPICTION_LOCKED")

local fork = source.fork_authored({
    branch_id = "test-branch",
    initial_state = "planted",
    reason = "Explicit hypothetical pre-threshold branch."
})
assert(fork.status == "authored_branch")
local branch = fork.machine

local skipped = branch.transition(widow, {
    record_id = "skip",
    from = "planted",
    to = "crossed",
    shared_tick = 1,
    reason = "Attempted state jump."
})
assert(skipped.code == "TRANSITION_NOT_ALLOWED")
assert(branch.snapshot().state == "planted")

assert(branch.transition(widow, {
    record_id = "hover",
    from = "planted",
    to = "hovering",
    shared_tick = 1,
    reason = "Authored hesitation."
}).status == "updated")

assert(branch.transition(widow, {
    record_id = "cross",
    from = "hovering",
    to = "crossed",
    shared_tick = 2,
    reason = "Authored crossing decision."
}).status == "updated")

assert(#branch.audit() == 2)
assert(branch.snapshot().crossing == "authored_crossing")

-- Neither the source object nor reflection was resolved by the branch.
assert(source.snapshot().state == "hovering")
assert(source.snapshot().crossing == "not_established")
assert(reflection.snapshot().lead_steps == 1)

local ritual = Ritual.new({
    registry = registry,
    group = group,
    allow_attributed_speculation = true,
    houses = {
        { handle = house1, plug = "present" },
        { handle = house2, plug = "fallen_out" },
        { handle = house3, plug = "present" }
    }
})

assert(ritual.snapshot().purpose.state == "intentionally_open")
assert(ritual.resolve_purpose("They imprison drowned souls.").code ==
    "PROTECTED_PURPOSE")

-- Synthetic story attempt, not a source fact.
local explanation = ritual.check_claim({
    id = "invented-explanation",
    subject = group,
    topic = "purpose",
    text = "The wax seals imprison the souls of drowned villagers.",
    treatment = "authoritative_resolution"
})
assert(explanation.status == "rejected")
assert(explanation.code == "MYSTERY_RESOLVED")

local speculation = ritual.check_claim({
    id = "widow-speculates",
    subject = group,
    topic = "purpose",
    text = "The widow wondered whether the little houses were offerings.",
    treatment = "attributed_speculation",
    speaker = widow
})
assert(speculation.status == "accepted")
assert(speculation.establishes_purpose == false)

local unreviewed = ritual.check_claim({
    id = "unreviewed-purpose",
    subject = group,
    topic = "purpose",
    text = "A candidate explanation.",
    treatment = "unreviewed"
})
assert(unreviewed.status == "blocked")

-- Mutating a returned copy does not unlock the object.
local snapshot = ritual.snapshot()
snapshot.purpose.state = "known"
assert(ritual.snapshot().purpose.state == "intentionally_open")

io.write("threshold_and_ritual_tests=passed\n")
