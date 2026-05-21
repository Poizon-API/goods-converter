import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100375 — «Угги, валенки, дутики» (мужская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100375,
  nodeName: "Угги, валенки, дутики",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Угги, валенки, дутики"],
});
