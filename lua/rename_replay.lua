-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: scene_loader.lua admitted-scene token.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local function path_set_bytes(paths)
    local sorted, seen = {}, {}

    for _, value in ipairs(paths) do
        assert(not seen[value], "duplicate changed path")
        seen[value] = true
        sorted[#sorted + 1] = value
    end

    -- Paths emitted by this module contain ASCII field names and indices.
    table.sort(sorted)

    if #sorted == 0 then return "" end
    return table.concat(sorted, "\n") .. "\n"
end

function M.replay(loader, source_token, operation)
    assert(type(operation) == "table"
        and operation.operation == "rename_entity"
        and type(operation.from) == "string" and operation.from ~= ""
        and type(operation.to) == "string" and operation.to ~= ""
        and operation.from ~= operation.to,
        "valid rename operation required")

    local scene = loader.read(source_token)
    assert(scene.schema_version == nil,
        "this replayer supports original unversioned v1 only")

    local source_index, matches = nil, 0

    for index, entity in ipairs(scene.entities) do
        assert(entity.id ~= operation.to, "destination entity ID exists")
        if entity.id == operation.from then
            source_index = index
            matches = matches + 1
        end
    end

    assert(matches == 1, "source entity must resolve exactly once")

    local paths = {}

    local function replace_field(container, name, pointer)
        if container[name] == operation.from then
            container[name] = operation.to
            paths[#paths + 1] = pointer
        end
    end

    local function replace_ids(values, pointer)
        for index, value in ipairs(values) do
            if value == operation.from then
                values[index] = operation.to
                paths[#paths + 1] =
                    pointer .. "/" .. string.format("%d", index - 1)
            end
        end
    end

    replace_field(
        scene.entities[source_index],
        "id",
        "/entities/" .. (source_index - 1) .. "/id"
    )

    local composition = scene.composition

    replace_field(composition, "principal_subject",
        "/composition/principal_subject")
    replace_field(composition, "focal_target",
        "/composition/focal_target")
    replace_ids(composition.eye_path, "/composition/eye_path")

    for _, layer in ipairs({"foreground", "middle_ground", "background"}) do
        replace_ids(
            composition.depth_layers[layer],
            "/composition/depth_layers/" .. layer
        )
    end

    for index, relationship in ipairs(scene.relationships) do
        local base = "/relationships/" .. (index - 1)
        replace_field(relationship, "subject", base .. "/subject")
        replace_field(relationship, "object", base .. "/object")
    end

    local canonical_paths = path_set_bytes(paths)

    if operation.expected_path_set_bytes ~= nil then
        assert(operation.expected_path_set_bytes == canonical_paths,
            "changed-path set differs from expected reference")
    end

    -- Original token was never mutated. Return a new admitted snapshot.
    local checked = loader.load(scene)
    assert(checked.status == "accepted",
        "renamed scene failed structural re-admission")

    return {
        status = "replayed",
        scene_token = checked.token,
        original_token = source_token,
        record = {
            operation = "rename_entity",
            from = operation.from,
            to = operation.to,
            schema_changed = false,
            changedPaths = paths,
            changedPathsSetBytes = canonical_paths
        }
    }
end

M.path_set_bytes = path_set_bytes
return M
