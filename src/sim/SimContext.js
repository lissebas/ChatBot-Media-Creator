import { createContext } from "react";

// Comparte el nodo activo del simulador con las tarjetas del lienzo para resaltarlo.
export const SimContext = createContext({ activeNodeId: null });
