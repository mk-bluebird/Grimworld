-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: admitted manifest records, then checks below.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local function key(ref)
    assert(type(ref) == "table"
        and type(ref.variant_id) == "string"
        and ref.variant_id:match("^[A-Za-z0-9_.-]+$")
        and type(ref.revision) == "number"
        and ref.revision == math.floor(ref.revision)
        and ref.revision >= 1 and ref.revision <= 1000000000,
        "invalid variant revision reference")

    return ref.variant_id .. "@" .. string.format("%.0f", ref.revision)
end

local function copy_ref(ref)
    return { variant_id = ref.variant_id, revision = ref.revision }
end

function M.new(records)
    assert(type(records) == "table" and #records <= 1024,
        "manifest record limit exceeded")

    local nodes, histories = {}, {}

    for _, record in ipairs(records) do
        local id = key(record)
        assert(not nodes[id], "duplicate variant revision")
        assert(type(record.derived_from) == "table"
            and #record.derived_from <= 128, "parent list required")

        nodes[id] = {
            ref = copy_ref(record),
            parents = {}
        }

        histories[record.variant_id] = histories[record.variant_id] or {}
        local history = histories[record.variant_id]
        history[#history + 1] = record.revision
    end

    for _, record in ipairs(records) do
        local node = nodes[key(record)]
        local seen = {}

        for _, parent in ipairs(record.derived_from) do
            local parent_key = key(parent)
            assert(nodes[parent_key], "declared parent revision missing")
            assert(not seen[parent_key], "duplicate parent edge")
            seen[parent_key] = true
            node.parents[#node.parents + 1] = parent_key
        end

        table.sort(node.parents)
    end

    -- Kahn traversal, treating parent -> child as the edge direction.
    local remaining, children, queue = {}, {}, {}

    for id, node in pairs(nodes) do
        remaining[id] = #node.parents
        children[id] = {}
    end

    for id, node in pairs(nodes) do
        for _, parent in ipairs(node.parents) do
            local list = children[parent]
            list[#list + 1] = id
        end
        if remaining[id] == 0 then queue[#queue + 1] = id end
    end

    local processed = 0
    for head = 1, #records do
        local id = queue[head]
        if not id then break end
        processed = processed + 1

        for _, child in ipairs(children[id]) do
            remaining[child] = remaining[child] - 1
            if remaining[child] == 0 then
                queue[#queue + 1] = child
            end
        end
    end

    assert(processed == #records, "lineage cycle")

    local warnings = {}
    local variant_ids = {}
    for id in pairs(histories) do variant_ids[#variant_ids + 1] = id end
    table.sort(variant_ids)

    for _, id in ipairs(variant_ids) do
        local history = histories[id]
        table.sort(history)

        for i = 2, #history do
            if history[i] > history[i - 1] + 1 then
                warnings[#warnings + 1] = {
                    code = "REVISION_HISTORY_SPARSE",
                    variant_id = id,
                    first_unstored = history[i - 1] + 1,
                    last_unstored = history[i] - 1
                }
            end
        end
    end

    local api = {}

    function api.ancestors(ref)
        local start = key(ref)
        assert(nodes[start], "unknown variant revision")

        local seen = { [start] = true }
        local queue = { start }
        local result = {}

        for head = 1, 1024 do
            local current = queue[head]
            if not current then break end

            for _, parent in ipairs(nodes[current].parents) do
                if not seen[parent] then
                    seen[parent] = true
                    queue[#queue + 1] = parent
                    result[#result + 1] = copy_ref(nodes[parent].ref)
                end
            end
        end

        return { status = "complete", ancestors = result }
    end

    function api.warnings()
        local result = {}
        for i, warning in ipairs(warnings) do
            result[i] = {
                code = warning.code,
                variant_id = warning.variant_id,
                first_unstored = warning.first_unstored,
                last_unstored = warning.last_unstored
            }
        end
        return result
    end

    return api
end

return M
