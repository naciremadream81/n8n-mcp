import { z } from "zod";
export const SearchPermitsInputSchema = z.object({
    address: z.string().min(5).optional(),
    county: z.string().min(2).optional(),
    permit_type: z.string().min(2).optional(),
    date_range: z
        .object({
        from: z.string().optional(),
        to: z.string().optional()
    })
        .optional()
});
export const GetPermitStatusInputSchema = z.object({
    permit_number: z.string().min(1),
    county: z.string().min(2)
});
export const GetCountyRequirementsInputSchema = z.object({
    county: z.string().min(2),
    permit_type: z.string().min(2),
    work_type: z.string().min(2)
});
export const GetPermitDocumentsInputSchema = z.object({
    permit_number: z.string().min(1),
    county: z.string().min(2)
});
export const SubmitPermitPackageInputSchema = z.object({
    permit_number: z.string().min(1),
    documents: z.array(z.object({
        name: z.string().min(1),
        mime_type: z.string().min(1),
        url: z.string().url().optional(),
        content_base64: z.string().optional()
    })),
    county: z.string().min(2)
});
