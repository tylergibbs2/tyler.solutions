from collections import defaultdict
import json
import statistics
import requests


GITHUB_USERNAME = "tylergibbs2"
TARGET_FILENAME = "language-stats.json"
REPOS_URL = "https://api.github.com/users/{username}/repos?per_page=100"
LANGUAGES_URL = "https://api.github.com/repos/{username}/{repo_name}/languages"
COLORS_URL = "https://raw.githubusercontent.com/ozh/github-colors/master/colors.json"


def get_language_stats(username: str, repo_name: str) -> dict:
    resp = requests.get(LANGUAGES_URL.format(username=username, repo_name=repo_name))
    return resp.json()


def get_language_colors() -> dict:
    resp = requests.get(COLORS_URL)
    return resp.json()


def get_repo_names(username: str) -> list[str]:
    resp = requests.get(REPOS_URL.format(username=username))
    all_repo_data = resp.json()
    return [
        repo["name"]
        for repo in all_repo_data
        if (not repo.get("fork") and not repo.get("private"))
    ]


def calculate_adaptive_weights(repos: list[str]) -> dict:
    """Calculate language weights based on their natural verbosity across repositories"""
    language_repo_counts = defaultdict(int)
    language_total_lines = defaultdict(int)
    
    print(f"Analyzing {len(repos)} repositories for language verbosity...")
    
    # Collect data across all repositories
    for repo in repos:
        repo_stats = get_language_stats(GITHUB_USERNAME, repo)
        for language, lines in repo_stats.items():
            language_repo_counts[language] += 1
            language_total_lines[language] += int(lines)
    
    # Filter out languages with less than 2000 total lines
    significant_languages = {
        lang: total_lines for lang, total_lines in language_total_lines.items() 
        if total_lines >= 2000
    }
    
    print(f"Filtered to {len(significant_languages)} languages with >=2000 total lines")
    
    # Calculate average lines per repository for each significant language
    avg_lines_per_repo = {}
    for language in significant_languages:
        if language_repo_counts[language] > 0:
            avg_lines_per_repo[language] = significant_languages[language] / language_repo_counts[language]
    
    # Calculate the median average lines per repo as baseline
    if avg_lines_per_repo:
        median_lines = statistics.median(avg_lines_per_repo.values())
        print(f"Median lines per repo: {median_lines:.0f}")
        
        # Create weights with a more balanced approach
        weights = {}
        for language, avg_lines in avg_lines_per_repo.items():
            # Use a softer weighting that doesn't overly penalize popular languages
            # Take the square root to reduce the impact of extreme differences
            ratio = median_lines / avg_lines
            weight = ratio ** 0.5  # Square root for softer weighting
            
            # Clamp weights between 0.3 and 2.0 to avoid extreme values
            weights[language] = max(0.3, min(2.0, weight))
        
        print("Language weights (higher = more concise):")
        for lang, weight in sorted(weights.items(), key=lambda x: x[1], reverse=True):
            avg_lines = avg_lines_per_repo[lang]
            print(f"  {lang}: {weight:.2f}x (avg {avg_lines:.0f} lines/repo)")
        
        return weights
    
    return {}


def main() -> None:
    global_stats = defaultdict(float)

    repos = get_repo_names(GITHUB_USERNAME)
    weights = calculate_adaptive_weights(repos)
    
    print(f"\nCalculating weighted stats...")
    for repo in repos:
        repo_stats = get_language_stats(GITHUB_USERNAME, repo)
        for language, lines in repo_stats.items():
            # Apply adaptive weight if available, otherwise use 1.0
            weight = weights.get(language, 1.0)
            weighted_lines = int(lines) * weight
            global_stats[language] += weighted_lines

    total = sum(global_stats.values())
    result = [
        {"language": key, "percentage": (value / total) * 100}
        for key, value in global_stats.items()
    ]
    result = sorted(result, key=lambda r: r["percentage"], reverse=True)

    print(f"\nFinal weighted percentages:")
    for i, lang in enumerate(result[:5], 1):
        print(f"  {i}. {lang['language']}: {lang['percentage']:.1f}%")

    colors_map = get_language_colors()
    for language in result:
        language["color"] = colors_map.get(language["language"], "#fff")

    with open(TARGET_FILENAME, "w") as fd:
        json.dump(result, fd)
    
    print(f"\nUpdated {TARGET_FILENAME}")


if __name__ == "__main__":
    main()
