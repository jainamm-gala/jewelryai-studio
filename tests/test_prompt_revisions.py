import pytest
from backend.models import JewelryDesign
from backend.prompts import local_interpret

@pytest.mark.parametrize("revision_prompt", ["Change the six prongs to four", "Change prongs to 4", "Use four prongs", "Four-prong setting"])
def test_prong_destination_is_used(revision_prompt):
    result = local_interpret(revision_prompt, JewelryDesign())
    assert result["design"]["setting"]["prongCount"] == 4
    assert result["changes"] == [{"path": "setting.prongCount", "oldValue": 6, "newValue": 4}]
