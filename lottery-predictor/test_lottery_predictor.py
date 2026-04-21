import pytest
from lottery_predictor import download_data, predict_next_draw

def test_download_data_non_empty():
    data = download_data()
    assert isinstance(data, list)
    assert len(data) > 0
    # each draw should have 7 numbers
    for draw in data:
        assert len(draw) == 7
        for n in draw:
            assert isinstance(n, int)

def test_predict_excludes_recent_numbers():
    draws = [[22, 24, 29, 31, 35, 4, 11], [1, 2, 3, 4, 5, 6, 7]]
    recent, exclusions, candidates = predict_next_draw(draws)
    assert recent == [1, 2, 3, 4, 5, 6, 7]
    for pos, ex in enumerate(exclusions):
        assert recent[pos] in ex
    for pos, cand in enumerate(candidates):
        for excluded in exclusions[pos]:
            assert excluded not in cand
    suggestion = [max(c, key=c.get) for c in candidates]
    assert len(suggestion) == 7
