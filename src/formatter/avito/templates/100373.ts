import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100373.json";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100373 — «Мокасины и лоферы» (мужская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100373,
  nodeName: "Мокасины и лоферы",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Мокасины и лоферы"],
  sizeValues: snapshot.externalValues.Size,
});
