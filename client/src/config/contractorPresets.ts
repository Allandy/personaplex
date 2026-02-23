export type ContractorPreset = {
  contractorId: string;
  label: string;
  textPrompt: string;
  voicePrompt: string;
};

const DEFAULT_DECKING_PROMPT =
  "You are the intake assistant for Summit Decking. Your only goal is to qualify homeowners and capture clear project details for a contractor callback. Keep responses brief, friendly, and practical. Ask one question at a time and collect: project address and ZIP, deck type (new build, replacement, extension, resurfacing, or repair), preferred material (pressure treated wood, cedar, composite, PVC), approximate deck size, number of levels, railings, stairs, lighting, and any cover or pergola request. Ask for timeline, budget range, HOA or permit constraints, and whether the property is occupied during work. If details are unclear, offer simple options and confirm the choice. Do not promise exact pricing. If asked about cost, provide only a broad estimate and say the contractor will confirm after review. Before ending, summarize captured details in bullets and ask for best callback contact and availability.";

const PRESETS: Record<string, ContractorPreset> = {
  decking_contractor: {
    contractorId: "decking_contractor",
    label: "Decking Contractor",
    textPrompt: DEFAULT_DECKING_PROMPT,
    voicePrompt: "NATF0.pt",
  },
  decking_north: {
    contractorId: "decking_north",
    label: "Decking Contractor",
    textPrompt: DEFAULT_DECKING_PROMPT,
    voicePrompt: "NATF0.pt",
  },
};

const DEFAULT_PRESET = PRESETS.decking_contractor;

export const getContractorPreset = (contractorId?: string | null): ContractorPreset => {
  if (!contractorId) {
    return DEFAULT_PRESET;
  }
  return PRESETS[contractorId] ?? DEFAULT_PRESET;
};
