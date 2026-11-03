-- RUNTIME: standard Lua 5.1 / Lua 5.4.
-- Luau requires module-loading/output adapters.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local L = require("lua.scene_loader")
local Registry = require("lua.entity_registry")
local Projection = require("lua.projection_digest")
local Lineage = require("lua.lineage")
local Rename = require("lua.rename_replay")

local O, A = L.object, L.array

local function figure(id, realm)
    return O({
        id = id, kind = "character", realm = realm,
        placement = "The word counterpart is descriptive text.",
        attributes = O({marker = "shared"}),
        basis = "explicit_description"
    })
end

local function fixture(twin)
    local entities = A({
        figure("widow", "living"),
        figure("counterpart", "parallel")
    })
    if twin then entities[3] = figure("waiting_woman", "parallel") end

    return O({
        id = "rename_fixture",
        provenance = O({
            basis = "user_supplied_description",
            invented_lore = true
        }),
        composition = O({
            principal_subject = "counterpart",
            focal_target = "counterpart",
            eye_path = A({"widow", "counterpart"}),
            depth_layers = O({
                foreground = A({}),
                middle_ground = A({"widow"}),
                background = A({"counterpart"})
            }),
            negative_space = "River."
        }),
        entities = entities,
        relationships = A({O({
            id = "pair",
            subject = "widow",
            object = "counterpart",
            predicate = "has_counterpart",
            qualifiers = O({}),
            basis = "explicit_description"
        })}),
        appearance = O({
            medium = "Oil.",
            palette = O({}),
            lights = A({}),
            surface_treatments = A({})
        }),
        constraints = A({})
    })
end

local loaded = L.load(fixture(true))
assert(loaded.status == "accepted")
local registry = Registry.new(L, loaded.token)

local a = registry.resolve("counterpart").handle
local b = registry.resolve("waiting_woman").handle
assert(a ~= b)

local profile = {
    id = "test.stable-fields",
    revision = "1",
    fields = {"/realm", "/kind", "/attributes/marker"}
}

local pa = Projection.projection_comparison_digest(registry, a, profile)
local pb = Projection.projection_comparison_digest(registry, b, profile)

assert(pa.digest == pb.digest)
assert(Projection.same_projection_bytes(pa, pb))
assert(registry.resolve("counterpart").handle ~=
    registry.resolve("waiting_woman").handle)

local lineage = Lineage.new({
    {variant_id="original", revision=1, derived_from={}},
    {
        variant_id="inspection", revision=1,
        derived_from={{variant_id="original", revision=1}}
    },
    {
        variant_id="waiting", revision=1,
        derived_from={{variant_id="inspection", revision=1}}
    }
})

local ancestry = lineage.ancestors({variant_id="waiting", revision=1})
assert(#ancestry.ancestors == 2)
assert(ancestry.ancestors[1].variant_id == "inspection")
assert(ancestry.ancestors[2].variant_id == "original")

local source = L.load(fixture(false))
assert(source.status == "accepted")

local expected_paths = {
    "/entities/1/id",
    "/composition/principal_subject",
    "/composition/focal_target",
    "/composition/eye_path/1",
    "/composition/depth_layers/background/0",
    "/relationships/0/object"
}

local replayed = Rename.replay(L, source.token, {
    operation = "rename_entity",
    from = "counterpart",
    to = "waiting_woman",
    expected_path_set_bytes = Rename.path_set_bytes(expected_paths)
})

assert(replayed.status == "replayed")
assert(#replayed.record.changedPaths == #expected_paths)

for i, pointer in ipairs(expected_paths) do
    assert(replayed.record.changedPaths[i] == pointer)
end

local changed = L.read(replayed.scene_token)
local original = L.read(source.token)

assert(changed.entities[2].id == "waiting_woman")
assert(original.entities[2].id == "counterpart")
assert(changed.entities[2].placement ==
    "The word counterpart is descriptive text.")
assert(changed.relationships[1].object == "waiting_woman")

io.write("projection_identity=distinct ancestry=exact rename_paths=6\n")
