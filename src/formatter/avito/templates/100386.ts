import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100386 — «Ботильоны» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100386,
  nodeName: "Ботильоны",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Ботильоны"],
});
