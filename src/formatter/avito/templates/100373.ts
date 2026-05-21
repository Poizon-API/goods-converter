import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100373 — «Мокасины и лоферы» (мужская обувь).
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100373,
  nodeName: "Мокасины и лоферы",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Мокасины и лоферы"],
});
