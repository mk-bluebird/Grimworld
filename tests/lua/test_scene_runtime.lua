-- RUNTIME: standard Lua 5.1 / 5.4.
-- Luau: replace only module-loading and result-output adapters.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local RNG = require("lua.rng")
local L = require("lua.scene_loader")
local Registry = require("lua.entity_registry")
local O, A = L.object, L.array

local function fixture()
    return O({
        id = "runtime_fixture",
        provenance = O({
            basis = "user_supplied_description",
            invented_lore = true
        }),
        composition = O({
            principal_subject = "widow",
            focal_target = "widow",
            eye_path = A({"widow"}),
            depth_layers = O({
                foreground = A({}),
                middle_ground = A({"widow"}),
                background = A({})
            }),
            negative_space = "River."
        }),
        entities = A({
            O({
                id = "widow",
                kind = "character",
                realm = "living",
                placement = "Causeway.",
                attributes = O({}),
                basis = "explicit_description"
            })
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
end

local r = RNG.new(1)
for _, value in ipairs({
    270369, 67634689, 2647435461, 307599695, 2398689233
}) do
    assert(r.next_integer() == value, "xorshift vector mismatch")
end

local restored = RNG.restore(r.serialize())
assert(restored.next_integer() == r.next_integer())
assert(not pcall(function() RNG.new(0) end))

local realms = {"living", "parallel", "river", "boundary", "unspecified"}
local random = RNG.new(17)
local accepted, rejected = 0, 0

for index = 0, 99 do
    local doc = fixture()
    local mode = index % 10
    local expected = mode == 0 or mode == 7 or mode == 8 or mode == 9

    if mode == 1 then
        doc.entities[1].realm = "afterlife"
    elseif mode == 2 then
        doc.entities[1].basis = "unverified"
    elseif mode == 3 then
        doc.entities[1].id = nil
    elseif mode == 4 then
        doc.entities[1].unexpected = true
    elseif mode == 5 then
        doc.relationships = A({O({id = "incomplete"})})
    elseif mode == 6 then
        doc.schema_version = "2.0.0"
    elseif mode == 7 then
        doc.entities[1].attributes.custom = O({value = "invented"})
    elseif mode == 8 then
        doc.entities[1].realm = realms[random.integer(1, #realms)]
    elseif mode == 9 then
        doc.entities[1].attributes.unresolved = L.NULL
    end

    local result = L.load(doc)
    assert((result.status == "accepted") == expected,
        "fixture decision mismatch at " .. index)

    if result.status == "accepted" then
        accepted = accepted + 1
    else
        assert(result.status == "rejected", "unexpected budget outcome")
        rejected = rejected + 1
    end
end

assert(accepted == 40 and rejected == 60)

-- Identical attributes under two canonical IDs remain distinct.
local doc = fixture()
doc.entities[2] = O({
    id = "waiting_woman",
    kind = "character",
    realm = "living",
    placement = "Causeway.",
    attributes = O({}),
    basis = "explicit_description"
})

local loaded = L.load(doc)
assert(loaded.status == "accepted")

local registry = Registry.new(L, loaded.token)
local a = registry.resolve("widow")
local b = registry.resolve("waiting_woman")
assert(a.status == "resolved" and b.status == "resolved")
assert(a.handle ~= b.handle)

-- An alias cannot merge canonical entities that already coexist.
assert(not pcall(function()
    Registry.new(L, loaded.token, {{
        migration_id = "illegal-merge",
        operation = "rename_entity",
        from = "widow",
        to = "waiting_woman"
    }}, function() return true end)
end))

-- A missing old name can resolve through an authorized rename record.
local migrated = Registry.new(L, loaded.token, {{
    migration_id = "rename-counterpart-001",
    operation = "rename_entity",
    from = "counterpart",
    to = "waiting_woman"
}}, function(record)
    -- Test double only; production authorization is external.
    return record.migration_id == "rename-counterpart-001"
end)

assert(migrated.resolve("counterpart").handle ==
    migrated.resolve("waiting_woman").handle)

io.write("fixtures=100 expected_accepted=40 expected_rejected=60\n")
