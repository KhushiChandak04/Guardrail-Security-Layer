from pprint import pprint

from app.main import app


def get_route_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for route in app.routes:
        methods = sorted(list(getattr(route, "methods", [])))
        methods_label = ",".join(methods) if methods else "WS"

        rows.append(
            {
                "path": str(route.path),
                "methods": methods_label,
                "name": str(route.name),
            }
        )
    return rows


if __name__ == "__main__":
    print("\nFastAPI Route Map\n")
    pprint(get_route_rows(), sort_dicts=False)
