import {
  apiQuery,
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
