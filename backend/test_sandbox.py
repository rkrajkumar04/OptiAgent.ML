import os
import sys

# Add the parent directory to Python path so we can import 'sandbox.executor'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sandbox.executor import execute_code_in_sandbox

def run_tests():
    print("--- STARTING SANDBOX VALIDATION TESTS ---")

    # TEST 1: Successful Code
    print("\n[Test 1]: Running successful code...")
    success_code = "print('Hello from the Sandbox!')\nprint('Math check:', 5 * 5)"
    res1 = execute_code_in_sandbox(success_code)
    
    print("  - Success status:", res1["success"])
    print("  - Captured Stdout:", repr(res1["stdout"]))
    
    assert res1["success"] is True, "Test 1 Failed: Should be successful"
    assert "Hello from the Sandbox!" in res1["stdout"], "Test 1 Failed: Missing printed text"
    assert "Math check: 25" in res1["stdout"], "Test 1 Failed: Incorrect stdout calculation"
    print("  => Test 1 Passed! ✅")

    # TEST 2: Code Exception/Crash
    print("\n[Test 2]: Running crashing code (division by zero)...")
    crash_code = "print('About to divide by zero...')\nresult = 1 / 0"
    res2 = execute_code_in_sandbox(crash_code)
    
    print("  - Success status:", res2["success"])
    print("  - Captured Stderr:", repr(res2["stderr"]))
    
    assert res2["success"] is False, "Test 2 Failed: Should have failed"
    assert "ZeroDivisionError" in res2["stderr"], "Test 2 Failed: Did not capture traceback"
    print("  => Test 2 Passed! ✅")

    # TEST 3: Code Timeout
    print("\n[Test 3]: Running infinite loop (timeout test)...")
    loop_code = "import time\nprint('Entering sleep...')\ntime.sleep(10)\nprint('Sleep done')"
    res3 = execute_code_in_sandbox(loop_code, timeout_seconds=2)
    
    print("  - Success status:", res3["success"])
    print("  - Captured Stderr:", repr(res3["stderr"]))
    
    assert res3["success"] is False, "Test 3 Failed: Should have timed out"
    assert "TIMEOUT ERROR" in res3["stderr"], "Test 3 Failed: Did not trigger timeout logs"
    print("  => Test 3 Passed! ✅")

    print("\n=============================================")
    print("🎉 ALL SANDBOX VALIDATION TESTS PASSED SUCCESSFULLY!")
    print("=============================================")

if __name__ == "__main__":
    run_tests()
