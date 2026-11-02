-- RUNTIME: standard Lua 5.1 / Lua 5.4.
-- Luau requires host-specific module loading/output adapters.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local L = require("lua.scene_loader")
local Registry = require("lua.entity_registry")
local Correspondence = require("lua.correspondence")
local Reflection = require("lua.reflection")

local O, A = L.object, L.array

local function entity(id, realm, pose)
    return O({
        id = id,
        kind = "depicted_figure",
        realm = realm,
        placement = "Comparison fixture.",
        attributes = O({ pose = pose }),
        basis = "explicit_description"
    })
end

local scene = O({
    id = "reflection_fixture",
    provenance = O({
        basis = "user_supplied_description",
        invented_lore = true
    }),
    composition = O({
        principal_subject = "widow",
        focal_target = "widow_reflection",
        eye_path = A({"widow", "widow_reflection"}),
        depth_layers = O({
            foreground = A({}),
            middle_ground = A({"widow", "widow_reflection"}),
            background = A({"counterpart"})
        }),
        negative_space = "River."
    }),
    entities = A({
        entity("widow", "living", "hesitating"),
        entity("widow_reflection", "river", "stepped_forward"),
        entity("counterpart", "parallel", "waiting")
    }),
    relationships = A({}),
    appearance = O({
        medium = "Oil.",
        palette = O({}),
        lights = A({}),
        surface_treatments = A({})
    }),
    constraints = A({})
})

local loaded = L.load(scene)
assert(loaded.status == "accepted")

local registry = Registry.new(L, loaded.token)
local owner = registry.resolve("widow").handle
local reflected = registry.resolve("widow_reflection").handle
local counterpart = registry.resolve("counterpart").handle

local machine = Reflection.new({
    registry = registry,
    correspondence = Correspondence,
    owner = owner,
    reflection = reflected,
    correspondence_rule = {
        scope = "listed_attributes",
        preserve = {},
        alter = {{
            key = "pose",
            operation = "replace",
            from = "hesitating",
            to = "stepped_forward"
        }},
        exceptions = {}
    }
})

for tick = 0, 3 do
    local snapshot = machine.observe(tick)
    assert(snapshot.lead_steps == 1)
    assert(snapshot.semantics == "depicted_not_proven")
    assert(snapshot.event_order == "unestablished")
end

assert(machine.request_lead(owner, 1, 3).code ==
    "ANOMALY_SCOPE_DENIED")
assert(machine.request_lead(counterpart, 1, 3).code ==
    "ANOMALY_SCOPE_DENIED")
assert(machine.request_lead(reflected, 2, 3).code ==
    "LEAD_OUT_OF_RANGE")
assert(machine.request_lead(reflected, 0, 3).code ==
    "SOURCE_DEPICTION_LOCKED")

-- No entity acquired an injected lead_steps field.
assert(registry.read(owner).attributes.lead_steps == nil)
assert(registry.read(counterpart).attributes.lead_steps == nil)
assert(registry.read(reflected).attributes.lead_steps == nil)

-- The original registry poses also remain unchanged.
assert(registry.read(owner).attributes.pose == "hesitating")
assert(registry.read(reflected).attributes.pose == "stepped_forward")

local denied = machine.authored_branch({
    branch_id = "unapproved-alignment",
    lead_steps = 0,
    reason = "Proposed revised depiction."
}, function() return false end)
assert(denied.code == "AUTHORING_NOT_AUTHORIZED")

local authored = machine.authored_branch({
    branch_id = "approved-alignment",
    lead_steps = 0,
    reason = "Explicitly authored alternative depiction."
}, function(proposal)
    -- Test double only, not production authorization.
    return proposal.branch_id == "approved-alignment"
end)

assert(authored.status == "authored_record")
assert(authored.origin == "creative_addition")
assert(authored.event_order == "unestablished")

-- Authoring a separate record never resolves the source machine.
assert(machine.snapshot().lead_steps == 1)

io.write("reflection_scope_tests=passed\n")
