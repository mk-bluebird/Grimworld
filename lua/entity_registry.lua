-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: an admitted scene from scene_loader.lua.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

function M.new(loader, scene_token, migrations, authorize)
    migrations = migrations or {}

    local scene = loader.read(scene_token)
    local canonical, aliases, issued = {}, {}, {}
    local entity_index = {}

    for i, entity in ipairs(scene.entities) do
        assert(not canonical[entity.id], "duplicate canonical entity ID")
        local handle = {}
        canonical[entity.id] = handle
        issued[handle] = entity.id
        entity_index[entity.id] = i
    end

    if #migrations > 0 then
        assert(type(authorize) == "function",
            "migration authorization adapter required")
    end

    for _, record in ipairs(migrations) do
        assert(type(record) == "table"
            and record.operation == "rename_entity"
            and type(record.from) == "string" and record.from ~= ""
            and type(record.to) == "string" and record.to ~= ""
            and record.from ~= record.to
            and type(record.migration_id) == "string"
            and record.migration_id ~= "",
            "invalid migration record")

        assert(authorize(record) == true, "migration not authorized")
        assert(not canonical[record.from],
            "redirect cannot merge an existing canonical entity")
        assert(not aliases[record.from], "duplicate redirect")
        aliases[record.from] = record.to
    end

    local resolved = {}
    for id, handle in pairs(canonical) do resolved[id] = handle end

    for from in pairs(aliases) do
        local current, seen = from, {}

        while not canonical[current] do
            assert(not seen[current], "redirect cycle")
            seen[current] = true
            current = aliases[current]
            assert(current, "dangling redirect")
        end

        resolved[from] = canonical[current]
    end

    local api = {}

    function api.resolve(id)
        local handle = resolved[id]
        if not handle then
            return { status = "dangling", requested_id = id }
        end

        return {
            status = "resolved",
            handle = handle,
            canonical_id = issued[handle],
            redirected = not canonical[id]
        }
    end

    function api.read(handle)
        local id = issued[handle]
        assert(id, "foreign entity handle")

        -- Loader returns a fresh defensive snapshot.
        local snapshot = loader.read(scene_token)
        return snapshot.entities[entity_index[id]]
    end

    return api
end

return M
