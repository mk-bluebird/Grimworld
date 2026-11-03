-- RUNTIME: standard Lua 5.1 / Lua 5.4.
-- Luau requires module-loading/output adapters.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local Guard = require("lua.anomaly_guard")
local Citations = require("lua.citation_graph")
local Gate = require("lua.publication_gate")

local reflection1, reflection2 = {}, {}
local records = {
    [reflection1] = {id = "widow_reflection"},
    [reflection2] = {id = "second_reflection"}
}
local registry = {
    read = function(handle)
        assert(records[handle], "foreign handle")
        return records[handle]
    end
}

local calls = 0
local guard = Guard.new({
    registry = registry,
    correspondence = {},
    rules = {{
        id = "reflection_lead",
        scope = {reflection1},
        violation = "depicted_step_lead",
        limit = 1,
        handler = function()
            calls = calls + 1
            return true
        end
    }}
})

local denied = guard.apply({
    rule_id = "reflection_lead",
    subject = reflection2,
    violation = "depicted_step_lead",
    operation_id = "second-reflection"
})
assert(denied.code == "ANOMALY_SCOPE_DENIED")
assert(calls == 0)

assert(guard.apply({
    rule_id = "reflection_lead",
    subject = reflection1,
    violation = "depicted_step_lead",
    operation_id = "first-reflection"
}).status == "applied")
assert(calls == 1)

local cycle = Citations.validate({
    {
        ref = "entity:a", basis = "derived_interpretation",
        supports = {"entity:b"}
    },
    {
        ref = "entity:b", basis = "derived_interpretation",
        supports = {"entity:c"}
    },
    {
        ref = "entity:c", basis = "derived_interpretation",
        supports = {"entity:a"}
    }
})
assert(cycle.status == "invalid")

local witness
for _, diagnostic in ipairs(cycle.diagnostics) do
    if diagnostic.code == "SUPPORT_CYCLE" then
        witness = diagnostic.witness
    end
end

assert(witness and #witness == 4)
assert(table.concat(witness, " -> ") ==
    "entity:a -> entity:b -> entity:c -> entity:a")

local writes = 0

-- These adapters suffice only for the forged-permit boundary test.
-- They are not a valid-scene admission fixture.
local gate = Gate.new({
    loader = {},
    citations = Citations,
    anomaly_guard = guard,
    additional_checks = function()
        return {status = "valid", diagnostics = {}}
    end,
    sink = function()
        writes = writes + 1
        return {
            status = "written",
            target = "test-only",
            receipt_id = "test-only"
        }
    end
})

local forged = {
    {},
    {ok = true, diagnostics = {}},
    {status = "valid", diagnostics = {}},
    {status = "budget_exhausted", diagnostics = {}},
    {status = "worker_failed", diagnostics = {}},
    {status = "valid", diagnostics = {{code = "ERROR"}}}
}

for _, envelope in ipairs(forged) do
    local result = gate.publish(envelope)
    assert(result.code == "INVALID_OR_CONSUMED_PERMIT")
end

assert(gate.publish(nil).code == "INVALID_OR_CONSUMED_PERMIT")
assert(gate.publish(true).code == "INVALID_OR_CONSUMED_PERMIT")
assert(writes == 0)

io.write("scope_guard=passed shortest_cycle=passed forged_permits=rejected\n")
