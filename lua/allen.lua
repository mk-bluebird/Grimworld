-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: none.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}
local MAX = 9007199254740991

local inverse = {
    before = "after", after = "before",
    meets = "met_by", met_by = "meets",
    overlaps = "overlapped_by", overlapped_by = "overlaps",
    starts = "started_by", started_by = "starts",
    during = "contains", contains = "during",
    finishes = "finished_by", finished_by = "finishes",
    equals = "equals"
}

local function valid(value)
    return type(value) == "table"
        and type(value.start) == "number"
        and type(value["end"]) == "number"
        and value.start == math.floor(value.start)
        and value["end"] == math.floor(value["end"])
        and value.start >= 0
        and value.start < value["end"]
        and value["end"] <= MAX
end

function M.validate(interval)
    return valid(interval)
end

function M.inverse(relation)
    assert(inverse[relation], "unknown Allen relation")
    return inverse[relation]
end

function M.relation(a, b)
    assert(valid(a) and valid(b), "invalid narrative interval")

    if a["end"] < b.start then return "before" end
    if a["end"] == b.start then return "meets" end
    if a.start > b["end"] then return "after" end
    if a.start == b["end"] then return "met_by" end

    if a.start == b.start then
        if a["end"] == b["end"] then return "equals" end
        return a["end"] < b["end"] and "starts" or "started_by"
    end

    if a["end"] == b["end"] then
        return a.start > b.start and "finishes" or "finished_by"
    end

    if a.start < b.start then
        return a["end"] < b["end"] and "overlaps" or "contains"
    end

    return a["end"] < b["end"] and "during" or "overlapped_by"
end

function M.overlaps(a, b)
    assert(valid(a) and valid(b), "invalid narrative interval")
    return math.max(a.start, b.start) < math.min(a["end"], b["end"])
end

return M
