import {
  apiQuery,
  cacheSeconds,
  endpointFor,
  parseFilters,
  toQueryString,
} from "@/components/search/params";

describe("parámetros de búsqueda", () => {
  it("lee solo valores válidos de la URL", () => {
    const filters = parseFilters({
      q: "  heladera ",
      department: "Rawson",
      price_min: "1000",
      price_max: "abc",
      sort: "hackeado",
      otro: "x",
    });
    expect(filters).toEqual({
      q: "heladera",
      department: "Rawson",
      price_min: "1000",
    });
  });

  it("arma la query string y omite claves", () => {
    expect(toQueryString({ q: "auto", category: "autos" }, ["category"])).toBe(
      "?q=auto",
    );
    expect(toQueryString({})).toBe("");
  });

  it("usa /search con texto y /listings sin texto", () => {
    expect(endpointFor({ q: "auto" })).toBe("/search");
    expect(endpointFor({})).toBe("/listings");
    expect(apiQuery({ q: "auto" }).sort).toBe("relevance");
    expect(apiQuery({}).sort).toBe("newest");
  });
});

describe("validación y caché acotada", () => {
  it("descarta departamentos, condiciones y monedas desconocidos", () => {
    expect(
      parseFilters({
        department: "Mendoza",
        condition: "roto",
        currency: "EUR",
      }),
    ).toEqual({});
    expect(
      parseFilters({
        department: "Valle Fértil",
        condition: "nuevo",
        currency: "USD",
      }),
    ).toEqual({
      department: "Valle Fértil",
      condition: "nuevo",
      currency: "USD",
    });
  });

  it("solo cachea combinaciones acotadas", () => {
    expect(cacheSeconds({ department: "Capital", sort: "newest" })).toBe(5);
    expect(cacheSeconds({ q: "auto" })).toBe(false);
    expect(cacheSeconds({ price_max: "1000" })).toBe(false);
  });
});
