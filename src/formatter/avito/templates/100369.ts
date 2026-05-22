import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100369.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100369 — «Ботинки и полуботинки» (мужская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100369,
  nodeName: "Ботинки и полуботинки",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Ботинки и полуботинки"],
  sizeValues: snapshot.externalValues.Size,
});
