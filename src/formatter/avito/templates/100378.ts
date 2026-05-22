import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100378.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100378 — «Сандалии» (мужская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100378,
  nodeName: "Сандалии",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Сандалии"],
  sizeValues: snapshot.externalValues.Size,
});
