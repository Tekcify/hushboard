use std::collections::VecDeque;
use std::time::{Duration, Instant};

const WINDOW: Duration = Duration::from_millis(500);
const KEYS_NEEDED: usize = 9;

#[derive(Default)]
pub struct Detector {
    recent: VecDeque<(Instant, u16)>,
}

impl Detector {
    pub fn push(&mut self, now: Instant, key: u16) -> bool {
        self.recent.push_back((now, key));
        while let Some(&(at, _)) = self.recent.front() {
            if now.duration_since(at) > WINDOW {
                self.recent.pop_front();
            } else {
                break;
            }
        }
        let mut distinct: Vec<u16> = self.recent.iter().map(|&(_, k)| k).collect();
        distinct.sort_unstable();
        distinct.dedup();
        if distinct.len() >= KEYS_NEEDED {
            self.recent.clear();
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(gaps_ms: &[u64], keys: &[u16]) -> bool {
        let mut d = Detector::default();
        let start = Instant::now();
        let mut at = 0;
        let mut hit = false;
        for (gap, key) in gaps_ms.iter().zip(keys) {
            at += gap;
            hit |= d.push(start + Duration::from_millis(at), *key);
        }
        hit
    }

    #[test]
    fn a_wipe_across_many_keys_is_detected() {
        let keys: Vec<u16> = (0..12).collect();
        assert!(run(&[30; 12], &keys));
    }

    #[test]
    fn fast_typing_is_not_detected() {
        let keys: Vec<u16> = (0..40).map(|i| i % 20).collect();
        assert!(!run(&[90; 40], &keys));
    }

    #[test]
    fn mashing_one_key_is_not_detected() {
        assert!(!run(&[20; 60], &[7; 60]));
    }

    #[test]
    fn slow_presses_are_not_detected() {
        let keys: Vec<u16> = (0..30).collect();
        assert!(!run(&[400; 30], &keys));
    }

    #[test]
    fn needs_nine_different_keys_inside_the_window() {
        let keys: Vec<u16> = (0..8).collect();
        assert!(!run(&[40; 8], &keys));
        let keys: Vec<u16> = (0..9).collect();
        assert!(run(&[40; 9], &keys));
    }

    #[test]
    fn a_detection_starts_the_count_again() {
        let mut d = Detector::default();
        let start = Instant::now();
        let mut hits = 0;
        for i in 0..18u64 {
            if d.push(start + Duration::from_millis(i * 20), (i % 18) as u16) {
                hits += 1;
            }
        }
        assert_eq!(hits, 2);
    }
}
