import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100377.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100377 — «Резиновая обувь» (мужская обувь).
 * Utility-template (см. JSDoc у utilityShoes-флага).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100377,
  nodeName: "Резиновая обувь",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Резиновая обувь"],
  utilityShoes: true,
  sizeValues: snapshot.externalValues.Size,
});
