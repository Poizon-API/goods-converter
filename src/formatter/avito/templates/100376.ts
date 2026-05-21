import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100376 — «Рабочая обувь» (мужская обувь).
 * Utility-template (см. JSDoc у utilityShoes-флага).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100376,
  nodeName: "Рабочая обувь",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Рабочая обувь"],
  utilityShoes: true,
});
