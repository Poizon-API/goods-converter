import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100395 — «Сандалии» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100395,
  nodeName: "Сандалии",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Сандалии"],
});
