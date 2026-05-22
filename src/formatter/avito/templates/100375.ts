import { type AvitoCategorySchema } from "../shared";
import snapshot from "../snapshots/avito-schema-100375.json";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100375 — «Угги, валенки, дутики» (мужская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100375,
  nodeName: "Угги, валенки, дутики",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Угги, валенки, дутики"],
  sizeValues: snapshot.externalValues.Size,
});
