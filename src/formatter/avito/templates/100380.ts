import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100380 — «Домашняя обувь» (мужская обувь).
 * Utility-template (см. JSDoc у utilityShoes-флага).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100380,
  nodeName: "Домашняя обувь",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Домашняя обувь"],
  utilityShoes: true,
});
