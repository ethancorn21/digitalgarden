#baby
[[technology]], [[Programming]]

---

## Sorting

Lists in python are created with the command:
```python
lists = ["this", "is", "a", "list"]
```
Lists start at index # 0 . So:
```python
print(my_list[0])
print(my_lists[1])
print(my_lists[-1])
## will print "this", "is", and "list" respectively
## an index of -1, always means the last index, no matter the length of ## the list
```

*lists* can be modified like so:
```python
my_list.append("now")   ## become the last element
my_list.pop()           ## remove the last element
my_list.pop(0)          ## first element
my_list.insert(0,"now") ## insert "now" as the first element
```

## Sorting

Elements of a list can be sorted easily:
```python
my_list.sort() ## permanent alphabetical sort
my_list.sort(reverse = True) ## permanent reverse alphabetical sort
print(sorted(my_list)) ## this prints a "temporary" sorted list
my_list.reverse() ## reverses the list by index (not alphabetically)
```

---
## See also:
for c# / statically typed languages:
[[Forward and Reverse Iteration Through an Array]]
