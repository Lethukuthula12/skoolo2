@manual @family_linking
Feature: Parents connect children
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_FAMILY_001 @P0
  Scenario: Redeem a family code
    Given new.parent@example.test has no linked children and Learner A has code FAMILYA23
    When the parent signs in and enters the code using Connect child
    Then Learner A appears once with School A and remains after refresh

  @TC_FAMILY_002 @P0
  Scenario: Multiple children
    Given a parent has one linked child and a valid code for another
    When the parent redeems the second code
    Then both children appear with their correct schools

  @TC_FAMILY_003 @P1
  Scenario: Repeated redemption
    Given parent A is already linked to Learner A
    When the parent submits FAMILYA23 again
    Then the learner appears once and no duplicate parent link is created

  @TC_FAMILY_004 @P1
  Scenario: Regenerated and invalid codes
    Given administrator A regenerates a learner family code
    When an unlinked parent tries the old or invalid code and then the new code
    Then invalid attempts create no links and the new code links the correct child

  @TC_FAMILY_005 @P1
  Scenario: Direct unrelated child access
    Given parent B is linked only to Learner B
    When parent B opens direct URLs and API requests for Learner A reports, attendance and fees
    Then no private information about Learner A is returned
