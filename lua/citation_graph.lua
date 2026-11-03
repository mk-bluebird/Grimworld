-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: none; references are checked within the supplied graph.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local BASIS = {
    explicit_description = true,
    derived_interpretation = true,
    implementation_choice = true
}

local function dense(values)
    if type(values) ~= "table" or getmetatable(values) ~= nil then
        return false, 0
    end
    local count, largest = 0, 0
    for key in pairs(values) do
        if type(key) ~= "number" or key < 1
            or key ~= math.floor(key) then
            return false, 0
        end
        count = count + 1
        if key > largest then largest = key end
    end
    return count == largest, count
end

local function qualified(value)
    return type(value) == "string" and #value <= 256
        and (
            value:match("^entity:.+$")
            or value:match("^relationship:.+$")
            or value:match("^constraint:.+$")
        ) ~= nil
end

local function better(candidate, previous)
    if previous == nil then return true end
    if #candidate ~= #previous then return #candidate < #previous end
    for i = 1, #candidate do
        if candidate[i] ~= previous[i] then
            return candidate[i] < previous[i]
        end
    end
    return false
end

function M.validate(nodes)
    local diagnostics = {}
    local valid_list, count = dense(nodes)

    if not valid_list then
        return {
            status = "invalid",
            diagnostics = {{ code = "INVALID_NODE_LIST" }}
        }
    end
    if count > 256 then
        return {
            status = "budget_exhausted",
            diagnostics = {{ code = "NODE_LIMIT" }}
        }
    end

    local index, names, graph = {}, {}, {}
    local edges = 0

    local function issue(code, ref, support)
        diagnostics[#diagnostics + 1] = {
            code = code, ref = ref, support = support
        }
    end

    for _, node in ipairs(nodes) do
        if type(node) ~= "table" or not qualified(node.ref) then
            issue("INVALID_NODE")
        elseif index[node.ref] then
            issue("DUPLICATE_NODE", node.ref)
        else
            index[node.ref] = node
            names[#names + 1] = node.ref
            graph[node.ref] = {}
        end
    end

    table.sort(names)

    for _, name in ipairs(names) do
        local node = index[name]
        if not BASIS[node.basis] then issue("INVALID_BASIS", name) end

        local supports = node.supports
        local ok, size = dense(supports)

        if not ok then
            issue("INVALID_SUPPORT_LIST", name)
        else
            edges = edges + size
            if edges > 2048 then
                return {
                    status = "budget_exhausted",
                    diagnostics = {{ code = "EDGE_LIMIT" }}
                }
            end

            if node.basis == "derived_interpretation" and size == 0 then
                issue("SUPPORT_REQUIRED", name)
            end

            local seen = {}
            for _, target in ipairs(supports) do
                if not qualified(target) then
                    issue("INVALID_SUPPORT", name)
                elseif seen[target] then
                    issue("DUPLICATE_SUPPORT", name, target)
                else
                    seen[target] = true
                    if not index[target] then
                        issue("DANGLING_SUPPORT", name, target)
                    else
                        if target == name then
                            issue("SELF_SUPPORT", name, target)
                        end
                        graph[name][#graph[name] + 1] = target
                    end
                end
            end
            table.sort(graph[name])
        end
    end

    local shortest
    local work = 0

    for _, start in ipairs(names) do
        local queue = { start }
        local visited = { [start] = true }
        local parent = {}
        local head = 1
        local found = false

        while head <= #queue and not found do
            local current = queue[head]
            head = head + 1

            for _, target in ipairs(graph[current]) do
                work = work + 1
                if work > 1000000 then
                    return {
                        status = "budget_exhausted",
                        diagnostics = {{ code = "CYCLE_SEARCH_LIMIT" }}
                    }
                end

                if target == start then
                    local reversed = {}
                    local cursor = current

                    while cursor ~= start do
                        reversed[#reversed + 1] = cursor
                        cursor = parent[cursor]
                    end

                    local witness = { start }
                    for i = #reversed, 1, -1 do
                        witness[#witness + 1] = reversed[i]
                    end
                    witness[#witness + 1] = start

                    if better(witness, shortest) then shortest = witness end
                    found = true
                    break
                elseif not visited[target] then
                    visited[target] = true
                    parent[target] = current
                    queue[#queue + 1] = target
                end
            end
        end
    end

    if shortest then
        diagnostics[#diagnostics + 1] = {
            code = "SUPPORT_CYCLE",
            witness = shortest
        }
    end

    if #diagnostics > 0 then
        return { status = "invalid", diagnostics = diagnostics }
    end

    return { status = "valid", diagnostics = {} }
end

return M
