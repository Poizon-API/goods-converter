import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100397.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100397 — «Домашняя обувь» (женская обувь).
 * Utility-template (см. JSDoc у utilityShoes-флага).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100397,
  nodeName: "Домашняя обувь",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Домашняя обувь"],
  utilityShoes: true,
  sizeValues: snapshot.externalValues.Size,
});
