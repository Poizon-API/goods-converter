import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100383 — «Туфли» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100383,
  nodeName: "Туфли",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Туфли"],
});
