import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100371 — «Кеды» (мужская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100371,
  nodeName: "Кеды",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Кеды"],
});
