-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCY: inject allen.lua using M.new(Allen).
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

local function scalar(value)
    local t = type(value)
    return t == "string" or t == "boolean"
        or (t == "number" and value == value
            and value ~= math.huge and value ~= -math.huge)
end

local function dense_list(input)
    if type(input) ~= "table" or getmetatable(input) ~= nil then return false end
    local count, largest = 0, 0
    for key in pairs(input) do
        if type(key) ~= "number" or key < 1 or key ~= math.floor(key) then
            return false
        end
        count = count + 1
        if key > largest then largest = key end
    end
    return count == largest, count
end

local function limits(input)
    input = input or {}
    local comparisons = input.maxComparisons or 1000000
    local conflicts = input.maxConflicts
    if conflicts == nil then conflicts = 100000 end

    assert(type(comparisons) == "number"
        and comparisons == math.floor(comparisons) and comparisons >= 0,
        "invalid comparison budget")
    assert(type(conflicts) == "number"
        and conflicts == math.floor(conflicts) and conflicts >= 0,
        "invalid conflict budget")

    return comparisons, conflicts
end

local function pair(a, b)
    if a < b then return { a, b } end
    return { b, a }
end

local function finish(conflicts, comparisons)
    table.sort(conflicts, function(a, b)
        if a[1] ~= b[1] then return a[1] < b[1] end
        return a[2] < b[2]
    end)
    return {
        status = "complete",
        conflicts = conflicts,
        comparisons = comparisons
    }
end

function M.new(Allen)
    local issued = setmetatable({}, { __mode = "k" })
    local api = {}

    function api.prepare(input)
        local valid, count = dense_list(input)
        if not valid or count > 10000 then
            return {
                status = "rejected",
                diagnostics = {{ code = "INVALID_OR_OVERSIZED_LIST" }}
            }
        end

        local ids, rows, diagnostics = {}, {}, {}

        for index, raw in ipairs(input) do
            local ok, row = pcall(function()
                assert(type(raw) == "table" and getmetatable(raw) == nil,
                    "plain assertion required")

                for _, field in ipairs({"id", "world", "subject", "predicate"}) do
                    assert(type(raw[field]) == "string"
                        and #raw[field] >= 1 and #raw[field] <= 128
                        and raw[field]:match("^[A-Za-z0-9_.:-]+$"),
                        "invalid machine identifier")
                end

                assert(not ids[raw.id], "duplicate assertion ID")
                ids[raw.id] = true

                assert(Allen.validate(raw), "invalid interval")
                assert(scalar(raw.value), "normalized scalar required")
                assert(type(raw.value) ~= "string" or #raw.value <= 4096,
                    "scalar string too long")

                assert(raw.epistemic == "canon" or raw.epistemic == "belief"
                    or raw.epistemic == "rumor"
                    or raw.epistemic == "interpretation",
                    "invalid epistemic category")
                assert(raw.cardinality == "single"
                    or raw.cardinality == "multiple",
                    "invalid cardinality")

                return {
                    id = raw.id, world = raw.world,
                    subject = raw.subject, predicate = raw.predicate,
                    start = raw.start, ["end"] = raw["end"],
                    value = raw.value,
                    epistemic = raw.epistemic,
                    cardinality = raw.cardinality
                }
            end)

            if not ok then
                diagnostics[#diagnostics + 1] = {
                    code = "INVALID_ASSERTION",
                    index = index,
                    message = tostring(row)
                }
            elseif row.epistemic == "canon" and row.cardinality == "single" then
                rows[#rows + 1] = row
            end
        end

        if #diagnostics > 0 then
            return { status = "rejected", diagnostics = diagnostics }
        end

        local token = {}
        issued[token] = rows
        return { status = "accepted", token = token }
    end

    local function run(token, options, sweep)
        local rows = issued[token]
        if not rows then return { status = "invalid_token" } end

        local max_comparisons, max_conflicts = limits(options)
        local comparisons, conflicts = 0, {}

        local function candidate(a, b)
            if comparisons >= max_comparisons then
                return "comparison_limit_exceeded"
            end
            comparisons = comparisons + 1

            if a.value ~= b.value and Allen.overlaps(a, b) then
                if #conflicts >= max_conflicts then
                    return "conflict_limit_exceeded"
                end
                conflicts[#conflicts + 1] = pair(a.id, b.id)
            end
            return nil
        end

        local function incomplete(status)
            return {
                status = status,
                comparisons = comparisons,
                emittedConflictCount = #conflicts
            }
        end

        if not sweep then
            for i = 1, #rows do
                for j = i + 1, #rows do
                    local a, b = rows[i], rows[j]
                    if a.world == b.world and a.subject == b.subject
                        and a.predicate == b.predicate then
                        local stopped = candidate(a, b)
                        if stopped then return incomplete(stopped) end
                    end
                end
            end
        else
            local worlds = {}

            for _, row in ipairs(rows) do
                worlds[row.world] = worlds[row.world] or {}
                local subjects = worlds[row.world]
                subjects[row.subject] = subjects[row.subject] or {}
                local predicates = subjects[row.subject]
                predicates[row.predicate] = predicates[row.predicate] or {}
                local group = predicates[row.predicate]
                group[#group + 1] = row
            end

            for _, subjects in pairs(worlds) do
                for _, predicates in pairs(subjects) do
                    for _, group in pairs(predicates) do
                        table.sort(group, function(a, b)
                            if a.start ~= b.start then return a.start < b.start end
                            if a["end"] ~= b["end"] then
                                return a["end"] < b["end"]
                            end
                            return a.id < b.id
                        end)

                        local active = {}

                        for _, current in ipairs(group) do
                            local kept = 0
                            local previous_count = #active

                            for i = 1, previous_count do
                                local previous = active[i]

                                -- Named policy: meets is not duration overlap.
                                if previous["end"] > current.start then
                                    kept = kept + 1
                                    active[kept] = previous

                                    local stopped = candidate(previous, current)
                                    if stopped then return incomplete(stopped) end
                                end
                            end

                            for i = previous_count, kept + 1, -1 do
                                active[i] = nil
                            end
                            active[kept + 1] = current
                        end
                    end
                end
            end
        end

        return finish(conflicts, comparisons)
    end

    function api.pairwise(token, options)
        return run(token, options, false)
    end

    function api.sweep(token, options)
        return run(token, options, true)
    end

    return api
end

return M
