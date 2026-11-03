-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: none.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

function M.run(specification, operation)
    assert(type(specification) == "table", "test specification required")
    assert(type(specification.id) == "string"
        and specification.id ~= "", "test ID required")
    assert(type(specification.expected_status) == "string",
        "expected operation status required")
    assert(specification.expected_code == nil
        or type(specification.expected_code) == "string",
        "expected code must be a string")
    assert(type(operation) == "function", "operation adapter required")

    local ok, observed = pcall(operation)

    if not ok then
        return {
            test_id = specification.id,
            verdict = "internal_error",
            observation_status = "operation_raised",
            publication_eligible = false
        }
    end

    if type(observed) ~= "table"
        or getmetatable(observed) ~= nil
        or type(rawget(observed, "status")) ~= "string" then
        return {
            test_id = specification.id,
            verdict = "fail",
            observation_status = "malformed_result",
            publication_eligible = false
        }
    end

    local status_matches =
        observed.status == specification.expected_status

    local code_matches =
        specification.expected_code == nil
        or rawget(observed, "code") == specification.expected_code

    return {
        test_id = specification.id,
        verdict = status_matches and code_matches and "pass" or "fail",

        expected_status = specification.expected_status,
        expected_code = specification.expected_code,

        observation_status = observed.status,
        observation_code = rawget(observed, "code"),

        -- A test result is evidence, never a publication capability.
        publication_eligible = false
    }
end

return M
