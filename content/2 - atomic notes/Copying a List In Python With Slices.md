#baby
[[technology]], [[Programming]]

---
Copy a list in python is easy.

```python
my_list = [1,2,3,4,5]
copied_list = my_list[:]

print(my_list)     # output = [1,2,3,4,5]
print(copied_list) # output = [1,2,3,4,5]

my_list.append(100)
copied_list.append(6)

print(my_list)     # output = [1,2,3,4,5,100]
print(copied_list) # output = [1,2,3,4,5,6]
```




---
## See also
[[Slices In Python]]
[[Lists In Python]]