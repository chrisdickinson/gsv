use serde_derive::{ Serialize, Deserialize };
use std::str::from_utf8;
use std::path::PathBuf;
use std::env::args;
use async_std::fs;
use dirs::home_dir;
use anyhow::{anyhow, bail};
use colored::*;
use regex;

#[derive(Serialize, Deserialize, Debug)]
struct Config {
    #[serde(default = "Config::default_url")]
    url: String,
    username: Option<String>,
    token: Option<String>,
    defaults: Option<ConfigDefaults>
}

#[derive(Serialize, Deserialize, Debug)]
struct ConfigDefaults {
    orgs: Option<Vec<String>>
}

#[derive(Deserialize, Debug)]
struct GitHubRepository {
    full_name: String
}

#[derive(Deserialize, Debug)]
struct GitHubTextMatch {
    fragment: String
}

#[derive(Deserialize, Debug)]
struct GitHubSearchResult {
    repository: GitHubRepository,
    path: String,
    sha: String,
    text_matches: Option<Vec<GitHubTextMatch>>
}

#[derive(Deserialize, Debug)]
struct GitHubSearchResponse {
    items: Vec<GitHubSearchResult>
}

fn setup() -> Vec<u8> {
    Vec::new()
}

impl Config {
    fn default_url() -> String {
        "https://api.github.com".to_string()
    }

    fn orgs(&self) -> Vec<String> {
        if let Some(defaults) = &self.defaults {
            if let Some(orgs) = &defaults.orgs {
                let orgs = orgs.clone();
                return orgs.iter().map(|xs| format!("org:{}", xs)).collect();
            }
        }
        return Vec::new()
    }
}

async fn github_search(config: &Config, params: &[String]) -> anyhow::Result<()> {
    let search_params = [
        &params[..],
        &config.orgs()[..]
    ].concat().join(" ");

    let mut url = format!("{}{}?q={}", &config.url, "/search/code", urlencoding::encode(&search_params));

    let param_rex: Vec<String> = params.iter().map(|param| regex::escape(param)).collect();
    let param_rex = format!("(?i)({})", param_rex.join("|"));
    let rex = regex::Regex::new(&param_rex).expect("could not build regex from parameters");

    let replacer = "$1".black().on_yellow().to_string();
    loop {
        println!("url={}", url);
        let mut response = surf2anyhow(
            surf::get(url)
            .set_header("user-agent", "gsv (github search vehicle)")
            .set_header("accept", "application/vnd.github.v3.text-match+json")
            .set_header("authorization", format!("token {}", config.token.as_ref().unwrap()))
            .await
        )?;
        if response.status() != 200 {
            return Err(anyhow!("Unexpected status={}", response.status()));
        }

        if let Some(link) = response.header("link") {
            println!("link={}", link);
            let next: Vec<_> = link.split(",").filter_map(|xs| {
                let bits: Vec<_> = xs.split(";").collect();
                let maybe_url = bits[0].trim();
                let end_idx = maybe_url.rfind(">");
                if end_idx.is_none() {
                    return None
                }
                let url = &maybe_url[1..end_idx.unwrap()];
                for param in &bits[1..] {
                    if *param == " rel=\"next\"" {
                        return Some(url)
                    }
                }
                None
            }).collect();

            if next.len() == 0 {
                break
            }
            url = next[0].to_string();
        } else {
            break
        }

        let response_data: GitHubSearchResponse = response.body_json().await?;

        for result in response_data.items {
            println!("{} {} ({}):", result.repository.full_name.green(), result.path.magenta(), result.sha.blue());

            for text in result.text_matches.unwrap() {
                println!("{}{}", "...".dimmed().to_string(), text.fragment.split("\n").map(|line| {
                    rex.replace_all(line, &replacer[..])
                }).collect::<Vec<_>>().join("\n...".dimmed().as_ref()));
            }
        }
    }

    Ok(())
}

fn surf2anyhow<T>(input: Result<T, surf::Exception>) -> anyhow::Result<T> {
    match input {
        Ok(r) => Ok(r),
        Err(e) => bail!(e)
    }
}

#[async_std::main]
async fn main() -> anyhow::Result<()> {
    // step 1: load rc file as toml
    //         if it doesn't exist, run setup
    // step 2: run search
    let mut config = PathBuf::new();
    config.push(home_dir().unwrap());
    config.push(".gsvrc");
    let raw_contents = fs::read(&config).await.unwrap_or_else(|_| Vec::new());
    let contents = from_utf8(&raw_contents).expect("Invalid utf8.");
    let config: Config = toml::from_str(&contents)?;
    if config.token.is_none() || config.username.is_none() {
        setup();
        return Ok(());
    }

    let argv: Vec<String> = args().collect();
    github_search(&config, &argv[1..]).await?;
    Ok(())
}
