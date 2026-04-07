## 1. Skill Structure Setup

- [x] 1.1 Create `skills/lottery-physics/` directory
- [x] 1.2 Create `skills/lottery-physics/SKILL.md` with basic skill structure

## 2. Parameter Parsing Implementation

- [x] 2.1 Implement natural language parameter parser for front zone
- [x] 2.2 Implement natural language parameter parser for back zone
- [x] 2.3 Implement seed parameter extraction
- [x] 2.4 Add error handling for malformed parameters

## 3. Simulation Execution Integration

- [x] 3.1 Create wrapper to call physics_lottery module from skill
- [x] 3.2 Implement timeout handling (60 seconds)
- [x] 3.3 Implement retry logic for simulation failures

## 4. Output Formatting

- [x] 4.1 Format front zone results as "[a, b, c]"
- [x] 4.2 Format back zone results as "[x, y]"
- [x] 4.3 Handle error messages with recovery suggestions

## 5. Testing & Validation

- [x] 5.1 Test with full request "前区1-35选5，后区1-12选2"
- [x] 5.2 Test with front zone only "前区1-35选5"
- [x] 5.3 Test with seed "前区1-35选5，seed=12345"
- [x] 5.4 Test with invalid parameters "前区abc选5" (parses but may fail simulation)
- [x] 5.5 Verify deterministic output with same seed