import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100371.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100371 — «Кеды» (мужская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100371,
  nodeName: "Кеды",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Кеды"],
  sizeValues: snapshot.externalValues.Size,
});
