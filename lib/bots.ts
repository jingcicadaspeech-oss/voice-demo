export type DemoBot = {
  id: string;
  name: string;
  description: string;
  agentId: string;
};

export const bots: DemoBot[] = [
  {
    id: "tpv-cn",
    name: "TPV (Chinese)",
    description: "After-sales support for the TPV China market.",
    agentId: "agent_dda3074da08f070928d7a7bf3e",
  },
  {
    id: "tpv-global",
    name: "TPV",
    description: "After-sales support for TPV customers in Europe and North America.",
    agentId: "agent_76c17db9064ac5313d023ec508",
  },
  {
    id: "dji-global",
    name: "DJI",
    description: "After-sales support for DJI customers in Europe and North America.",
    agentId: "agent_961409fa78fcde4fc852c65810",
  },
  {
    id: "hisense-mexico",
    name: "Hisense Mexico",
    description: "After-sales support for Hisense customers in Mexico.",
    agentId: "agent_2ea19528794e6953e76ea74f23",
  },
];

export function getBotById(id: string) {
  return bots.find((bot) => bot.id === id) ?? null;
}
