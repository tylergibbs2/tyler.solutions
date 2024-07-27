from collections import defaultdict
import json

import requests


GITHUB_USERNAME = "tylergibbs2"
TARGET_FILENAME = "language-stats.json"
REPOS_URL = "https://api.github.com/users/{username}/repos?per_page=100"
LANGUAGES_URL = "https://api.github.com/repos/{username}/{repo_name}/languages"
COLORS_URL = "https://raw.githubusercontent.com/ozh/github-colors/master/colors.json"


def get_language_stats(username: str, repo_name: str) -> dict:
    resp = requests.get(LANGUAGES_URL.format(
        username=username,
        repo_name=repo_name
    ))
    return resp.json()


def get_language_colors() -> dict:
    resp = requests.get(COLORS_URL)
    return resp.json()


def get_repo_names(username: str) -> list[str]:
    resp = requests.get(REPOS_URL.format(username=username))
    all_repo_data = resp.json()
    return [repo["name"] for repo in all_repo_data]


def main() -> None:
    global_stats = defaultdict(int)

    repos = get_repo_names(GITHUB_USERNAME)
    for repo in repos:
        repo_stats = get_language_stats(GITHUB_USERNAME, repo)
        for k, v in repo_stats.items():
            global_stats[k] += v


    total = sum(global_stats.values())
    result = [{"language": key, "percentage": (value / total) * 100} for key, value in global_stats.items()]
    result = sorted(result, key=lambda r: r["percentage"], reverse=True)

    colors_map = get_language_colors()
    for language in result:
        language["color"] = colors_map.get(language["language"], "#fff")

    with open(TARGET_FILENAME, "w") as fd:
        json.dump(result, fd)


if __name__ == "__main__":
    main()
