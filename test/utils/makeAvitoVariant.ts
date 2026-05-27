import { Currency, Vat, type Product } from "../../src/types";

export interface MakeAvitoVariantInput {
  productId: number;
  variantId: string;
  paramKey: string;
  paramValue: string;
  price: number;
  overrides?: Partial<Product>;
}

export function makeAvitoVariant({
  productId,
  variantId,
  paramKey,
  paramValue,
  price,
  overrides = {},
}: MakeAvitoVariantInput): Product {
  return {
    productId,
    variantId,
    title: `Product ${productId}`,
    description: "Базовое описание товара.",
    categoryId: 8713,
    price,
    currency: Currency.RUB,
    vat: Vat.VAT_20,
    images: ["https://cdn.example.com/img.jpg"],
    vendor: "Nike",
    params: [{ key: paramKey, value: paramValue }],
    ...overrides,
  };
}
