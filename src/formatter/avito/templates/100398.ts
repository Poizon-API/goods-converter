import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100398.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100398 — «Спортивная обувь» (женская обувь).
 * Utility-template (см. JSDoc у utilityShoes-флага).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100398,
  nodeName: "Спортивная обувь",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Спортивная обувь"],
  utilityShoes: true,
  sizeValues: snapshot.externalValues.Size,
});
