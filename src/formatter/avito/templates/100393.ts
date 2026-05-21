import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100393 — «Резиновая обувь» (женская обувь).
 * Utility-template (см. JSDoc у utilityShoes-флага).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100393,
  nodeName: "Резиновая обувь",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Резиновая обувь"],
  utilityShoes: true,
});
