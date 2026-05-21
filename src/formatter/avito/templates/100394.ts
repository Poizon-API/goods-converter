import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100394 — «Мокасины и лоферы» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100394,
  nodeName: "Мокасины и лоферы",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Мокасины и лоферы"],
});
