const nowIso = () => new Date().toISOString();
export async function searchPermits(input) {
    return {
        ok: true,
        tool: "search_permits",
        data: {
            query: input,
            permits: [],
            count: 0,
            generated_at: nowIso()
        },
        notes: ["Stub response: connect county data source for live records."]
    };
}
export async function getPermitStatus(input) {
    return {
        ok: true,
        tool: "get_permit_status",
        data: {
            permit_number: input.permit_number,
            county: input.county,
            status: "unknown",
            stage: "intake",
            outstanding_comments: [],
            generated_at: nowIso()
        },
        notes: ["Stub response: wire county status endpoint."]
    };
}
export async function getCountyRequirements(input) {
    return {
        ok: true,
        tool: "get_county_requirements",
        data: {
            county: input.county,
            permit_type: input.permit_type,
            work_type: input.work_type,
            checklist: [],
            fees: [],
            generated_at: nowIso()
        },
        notes: ["Stub response: map to live county requirement catalogs."]
    };
}
export async function getPermitDocuments(input) {
    return {
        ok: true,
        tool: "get_permit_documents",
        data: {
            permit_number: input.permit_number,
            county: input.county,
            documents: [],
            generated_at: nowIso()
        },
        notes: ["Stub response: attach county document retrieval integration."]
    };
}
export async function submitPermitPackage(input) {
    return {
        ok: true,
        tool: "submit_permit_package",
        data: {
            permit_number: input.permit_number,
            county: input.county,
            received_documents: input.documents.length,
            submission_status: "accepted_for_processing",
            submitted_at: nowIso()
        },
        notes: ["Stub response: replace with authenticated county portal submit."]
    };
}
